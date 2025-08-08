import { type PropsWithChildren, useState } from "react";

type CollapsibleProps = PropsWithChildren<{ 
    title: string, 
    startOpen?: boolean 
}>;

export function CollapsibleSection({ title, children, startOpen = false }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(startOpen);
  return (
    <div className="card">
      <div className="card-header cursor-pointer select-none" onClick={() => setIsOpen(!isOpen)}>
        <h3 className="font-semibold flex justify-between items-center">
          {title}
          <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-90'}`}>›</span>
        </h3>
      </div>
      {isOpen && <div className="card-body">{children}</div>}
    </div>
  )
}