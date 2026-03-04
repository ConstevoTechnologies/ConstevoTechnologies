interface Props {
  action: 'ASSIGN' | 'REVOKE';
}

export default function ActionBadge({ action }: Props) {
  return (
    <span
      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
        action === 'ASSIGN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {action}
    </span>
  );
}
