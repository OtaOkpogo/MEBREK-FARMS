export default function ChatBubble({ senderName, senderRole, message, createdAt, isOwn }) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[75%] flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
        {!isOwn && (
          <span className="text-xs font-semibold text-gray-500 mb-1 ml-1">
            {senderName}
            {senderRole && (
              <span className="font-normal text-gray-400"> · {senderRole}</span>
            )}
          </span>
        )}

        <div
          className={`rounded-2xl px-4 py-2 shadow-sm whitespace-pre-wrap text-sm ${
            isOwn
              ? "bg-green-700 text-white rounded-br-md"
              : "bg-gray-100 text-gray-900 rounded-bl-md"
          }`}
        >
          {message}
        </div>

        <span className={`text-[10px] text-gray-400 mt-1 ${isOwn ? "mr-1" : "ml-1"}`}>
          {createdAt ? new Date(createdAt).toLocaleString() : ""}
        </span>
      </div>
    </div>
  );
}
