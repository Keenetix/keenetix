"use client";
import { useEffect, useState } from "react";
import { AsciiField } from "@/components/ascii-field";
import { csrfFetch } from "@/lib/csrf-fetch";
type Commitment = { id: number; reference: string; objective: string; budget: string; asset: string; status: string };
type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  signAndSendTransaction: (transaction: import("@solana/web3.js").Transaction) => Promise<{ signature: string }>;
};
declare global { interface Window { solana?: PhantomProvider } }
const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "";
const usdcMint = process.env.NEXT_PUBLIC_SOLANA_USDC_MINT ?? "";
const escrowTokenAccount = process.env.NEXT_PUBLIC_SOLANA_ESCROW_TOKEN_ACCOUNT ?? "";
const USDC_DECIMALS = 6;
export function SolanaSettlementConsole() {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signature, setSignature] = useState("");
  const load = async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const data = await response.json() as { commitments?: Commitment[] };
    if (response.ok) {
      const eligible = (data.commitments ?? []).filter((commitment) => ["verified", "awaiting_settlement", "settlement_submitted"].includes(commitment.status));
      setCommitments(eligible); if (eligible[0]) setSelectedId(String(eligible[0].id));
    }
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount
  useEffect(() => { void load(); }, []);
  const connect = async () => {
    setError("");
    if (!window.solana?.isPhantom) { setError("No Solana wallet was detected. Install Phantom."); return; }
    try { const resp = await window.solana.connect(); setAccount(resp.publicKey.toString()); } catch { setError("Wallet connection was rejected."); }
  };
  const submit = async () => {
    setError(""); setStatus("");
    const commitment = commitments.find((item) => item.id === Number(selectedId));
    if (!commitment || !window.solana?.isPhantom || !account) { setError("Connect a wallet and choose a verified commitment first."); return; }
    if (!rpcUrl || !usdcMint || !escrowTokenAccount) { setError("Solana settlement is not configured. Set NEXT_PUBLIC_SOLANA_RPC_URL, NEXT_PUBLIC_SOLANA_USDC_MINT, and NEXT_PUBLIC_SOLANA_ESCROW_TOKEN_ACCOUNT."); return; }
    setSubmitting(true);
    try {
      const { Connection, PublicKey, Transaction } = await import("@solana/web3.js");
      const { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
      const connection = new Connection(rpcUrl, "confirmed");
      const owner = new PublicKey(account);
      const mint = new PublicKey(usdcMint);
      const destination = new PublicKey(escrowTokenAccount);
      const source = await getAssociatedTokenAddress(mint, owner);
      const amount = toUnits(commitment.budget);
      const transaction = new Transaction().add(createTransferInstruction(source, destination, owner, amount, [], TOKEN_PROGRAM_ID));
      transaction.feePayer = owner;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      const { signature: sig } = await window.solana.signAndSendTransaction(transaction);
      setSignature(sig);
      const response = await csrfFetch("/api/settlements/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commitmentId: commitment.id, transactionHash: sig, chain: "solana", escrowAddress: escrowTokenAccount }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to record settlement.");
      setStatus(`Transaction ${sig.slice(0, 10)}… submitted. Confirm it after the receipt is available.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Wallet transaction failed."); }
    setSubmitting(false);
  };
  const confirm = async () => {
    if (!signature) { setError("Submit a wallet transaction before checking a receipt."); return; }
    setStatus("Checking the configured RPC for a receipt…"); setError("");
    const response = await csrfFetch("/api/settlements/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionHash: signature }) });
    const data = await response.json() as { error?: string; status?: string };
    if (!response.ok) setError(data.error ?? "Receipt is not available yet."); else setStatus(data.status === "settled" ? "Receipt confirmed. Value settled and worker reputation updated." : "Receipt is still pending.");
  };
  return <section className="settlement-console"><div className="settlement-intro"><p className="section-label">Solana settlement console</p><h1>Same proof.<br /><em>Different rail.</em></h1><p>Connect a Solana wallet to submit a USDC (SPL token) escrow transfer on your configured cluster. Keenetix stores the signature, then confirms the receipt server-side before updating settlement and reputation.</p><div className="settlement-config"><span>USDC mint {usdcMint ? "configured" : "missing"}</span><span>Escrow {escrowTokenAccount ? "configured" : "missing"}</span><span>RPC {rpcUrl ? "configured" : "missing"}</span></div></div><div className="settlement-card"><AsciiField rows={8} cols={30} variant="scan" className="field-cover field-settle" /><div className="wallet-line"><div><span>SOLANA WALLET</span><b>{account ? `${account.slice(0, 4)}…${account.slice(-4)}` : "Not connected"}</b></div><button onClick={() => void connect()}>{account ? "Connected" : "Connect Phantom"}</button></div><label>Verified commitment<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Choose a commitment</option>{commitments.map((commitment) => <option value={commitment.id} key={commitment.id}>{commitment.reference} · {commitment.objective} · {Number(commitment.budget).toLocaleString()} USDC</option>)}</select></label><div className="escrow-explainer"><b>USDC transfer → escrow</b><p>The wallet sends an SPL token transfer to your configured escrow token account. Keenetix never fabricates a transaction signature.</p></div><button className="button button-coral" disabled={!account || !selectedId || submitting} onClick={() => void submit()}>{submitting ? "Awaiting wallet…" : "Submit USDC settlement"}</button><button className="receipt-button" disabled={!signature} onClick={() => void confirm()}>Check on-chain receipt →</button>{status && <p className="settlement-status">{status}</p>}{error && <p className="form-error">{error}</p>}</div></section>;
}
function toUnits(amount: string) { const [whole, fraction = ""] = amount.split("."); return BigInt(whole || "0") * BigInt(1000000) + BigInt(`${fraction}000000`.slice(0, USDC_DECIMALS)); }
