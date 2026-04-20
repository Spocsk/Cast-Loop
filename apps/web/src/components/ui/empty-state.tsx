import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function EmptyState({ icon, title, description, actions }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      {icon ? <div className="empty-state-icon" aria-hidden="true">{icon}</div> : null}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {actions ? <div className="empty-state-actions">{actions}</div> : null}
    </div>
  );
}
