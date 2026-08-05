"use client";
import { useEffect, useState } from "react";
type Commitment = { id: number; reference: string; objective: string; budget: string; asset: string; status: string };
type EthereumProvider = { request: (request: { method: string; params?: unknown[] }) => Promise<unknown> };
declare global { interface Window { ethereum?: EthereumProvider } }
const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "";
const escrowAddress = process.env.NEXT_PUBLIC_KEENETIX_ESCROW_ADDRESS ?? "";
const configuredChainId = Number(process.env.NEXT_PUBLIC_KEENETIX_CHAIN_ID ?? "0");
export function WalletSettlementConsole() {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transactionHash, setTransactionHash] = useState("");
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
    if (!window.ethereum) { setError("No EIP-1193 wallet was detected. Install a wallet such as MetaMask."); return; }
    try { const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[]; setAccount(accounts[0] ?? ""); } catch { setError("Wallet connection was rejected."); }
  };
  const submit = async () => {
    setError(""); setStatus("");
    const commitment = commitments.find((item) => item.id === Number(selectedId));
    if (!commitment || !window.ethereum || !account) { setError("Connect a wallet and choose a verified commitment first."); return; }
    if (!isAddress(usdcAddress) || !isAddress(escrowAddress) || !configuredChainId) { setError("Testnet settlement is not configured. Set NEXT_PUBLIC_USDC_ADDRESS, NEXT_PUBLIC_KEENETIX_ESCROW_ADDRESS, and NEXT_PUBLIC_KEENETIX_CHAIN_ID."); return; }
    setSubmitting(true);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${configuredChainId.toString(16)}` }] });
      const hash = await window.ethereum.request({ method: "eth_sendTransaction", params: [{ from: account, to: usdcAddress, data: encodeUsdcTransfer(escrowAddress, commitment.budget) }] }) as string;
      setTransactionHash(hash);
      const response = await fetch("/api/settlements/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commitmentId: commitment.id, transactionHash: hash, chainId: configuredChainId, escrowAddress }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to record settlement.");
      setStatus(`Transaction ${hash.slice(0, 10)}… submitted. Confirm it after the testnet receipt is available.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Wallet transaction failed."); }
    setSubmitting(false);
  };
   const confirm = async () => {
    const commitment = commitments.find((item) => item.id === Number(selectedId));
    if (!commitment || !transactionHash) { setError("Submit a wallet transaction before checking a receipt."); return; }
    setStatus("Checking the configured RPC for a receipt…"); setError("");
    const response = await fetch("/api/settlements/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionHash }) });
    const data = await response.json() as { error?: string; status?: string };
    if (!response.ok) setError(data.error ?? "Receipt is not available yet."); else setStatus(data.status === "settled" ? "Receipt confirmed. Value settled and worker reputation updated." : "Receipt is still pending.");
  };
  return <section className="settlement-console"><div className="settlement-intro"><p className="section-label">Testnet settlement console</p><h1>Proof clears.<br /><em>Capital moves.</em></h1><p>Connect an EIP-1193 wallet to submit a USDC escrow transfer on your configured testnet. Keenetix stores the transaction hash, then confirms the receipt server-side before updating settlement and reputation.</p><div className="settlement-config"><span>USDC {usdcAddress ? "configured" : "missing"}</span><span>Escrow {escrowAddress ? "configured" : "missing"}</span><span>Chain {configuredChainId || "missing"}</span></div></div><div className="settlement-card"><div className="wallet-line"><div><span>WALLET</span><b>{account ? `${account.slice(0, 7)}…${account.slice(-4)}` : "Not connected"}</b></div><button onClick={() => void connect()}>{account ? "Connected" : "Connect wallet"}</button></div><label>Verified commitment<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Choose a commitment</option>{commitments.map((commitment) => <option value={commitment.id} key={commitment.id}>{commitment.reference} · {commitment.objective} · {Number(commitment.budget).toLocaleString()} USDC</option>)}</select></label><div className="escrow-explainer"><b>USDC transfer → escrow</b><p>The wallet sends an ERC-20 transfer to your configured escrow address. Keenetix never fabricates a transaction hash.</p></div><button className="button button-coral" disabled={!account || !selectedId || submitting} onClick={() => void submit()}>{submitting ? "Awaiting wallet…" : "Submit USDC settlement"} <ArrowIcon /></button><button className="receipt-button" disabled={!selectedId} onClick={() => void confirm()}>Check on-chain receipt →</button>{status && <p className="settlement-status">{status}</p>}{error && <p className="form-error">{error}</p>}</div></section>;
}
function isAddress(value: string) { return /^0x[a-fA-F0-9]{40}$/.test(value); }
function encodeUsdcTransfer(recipient: string, amount: string) { const units = toUnits(amount); return `0xa9059cbb${recipient.slice(2).padStart(64, "0")}${units.toString(16).padStart(64, "0")}`; }
function toUnits(amount: string) { const [whole, fraction = ""] = amount.split("."); return BigInt(whole || "0") * BigInt(1000000) + BigInt(`${fraction}000000`.slice(0, 6)); }
function ArrowIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>; }
