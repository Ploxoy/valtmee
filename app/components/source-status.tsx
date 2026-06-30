import {
  sourceTextClassName,
  type SourceStatus,
} from "../lib/metrics";

export function SourceName({
  children,
  status,
}: {
  children: string;
  status?: SourceStatus;
}) {
  return <span className={sourceTextClassName(status)}>{children}</span>;
}

export function SourceAwareNote({
  note,
  source,
  status,
}: {
  note: string;
  source: string;
  status?: SourceStatus;
}) {
  const parts = note.split(source);

  if (parts.length === 1) {
    return <>{note}</>;
  }

  return (
    <>
      {parts.map((part, index) => (
        <span key={`${source}-${index}`}>
          {index > 0 && <SourceName status={status}>{source}</SourceName>}
          {part}
        </span>
      ))}
    </>
  );
}
