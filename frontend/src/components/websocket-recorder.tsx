import { useState, useMemo } from "react";
import { useComparison } from "@/contexts/comparison-context"; // Adjust path as needed
import { type ProviderName } from "@/lib/provider-features"; // Assuming ProviderName is exported here

interface WebSocketRecorderProps {
  filterByProvider?: ProviderName;
}

const WebSocketRecorder = ({ filterByProvider }: WebSocketRecorderProps) => {
  const { rawMessages, clearRawMessages } = useComparison();
  const [showMessages, setShowMessages] = useState(false);

  const filteredMessages = useMemo(() => {
    if (filterByProvider) {
      return rawMessages.filter((msg) => msg.provider === filterByProvider);
    }
    return rawMessages;
  }, [rawMessages, filterByProvider]);

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `[\n  ${filteredMessages.map((msg) => `${msg.data}`).join(",\n  ")}\n]`
    );
    alert(
      `Recorded messages ${filterByProvider ? `for '${filterByProvider}' ` : ""}
      copied to clipboard as a JSON array string!`
    );
  };

  const handleClear = () => {
    clearRawMessages();
    alert("All recorded WebSocket messages have been cleared.");
  };

  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: "16px",
      }}
    >
      <button
        onClick={() => setShowMessages(!showMessages)}
        style={{ marginBottom: "10px", padding: "8px 12px", cursor: "pointer" }}
      >
        {showMessages ? "Hide" : "Show"} Recorded WebSocket Messages
        {filterByProvider && ` (Filtered by: ${filterByProvider})`}
        {` (${filteredMessages.length})`}
      </button>
      {showMessages && (
        <div style={{ marginTop: "10px" }}>
          <div style={{ marginBottom: "10px", display: "flex", gap: "10px" }}>
            <button
              onClick={handleCopy}
              disabled={filteredMessages.length === 0}
              style={{ padding: "8px 12px", cursor: "pointer" }}
            >
              Copy {filterByProvider ? `'${filterByProvider}' ` : "All "}
              Messages
            </button>
            <button
              onClick={handleClear}
              disabled={rawMessages.length === 0} // Always base disable on total messages as it clears all
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                backgroundColor: "#f8d7da",
                color: "#721c24",
              }}
            >
              Clear All Recorded Messages
            </button>
          </div>
          <textarea
            readOnly
            value={`[\n  ${filteredMessages
              .map((msg) => msg.data) // Display only the data part of the RawMessage
              .join(",\n  ")}\n]`}
            style={{
              width: "calc(100% - 16px)", // Adjust for padding
              height: "300px",
              marginTop: "10px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              padding: "8px",
              fontFamily: "monospace",
            }}
            placeholder={`No WebSocket messages recorded${
              filterByProvider ? ` for '${filterByProvider}'` : ""
            }...`}
          />
        </div>
      )}
    </div>
  );
};

export default WebSocketRecorder;
