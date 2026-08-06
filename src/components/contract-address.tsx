"use client";
import { useState } from "react";

export function ContractAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button className="kntx-ca" onClick={() => void copy()} aria-label="Copy contract address">
      <span>CA</span>
      <b>{address}</b>
      <i>{copied ? "Copied ✓" : "Copy"}</i>
    </button>
  );
}
