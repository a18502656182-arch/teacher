import type { ComponentProps } from 'react';
/** The standalone Vite host has no Next router; retain ordinary link semantics. */
export default function PreviewLink(props: ComponentProps<'a'>) { return <a {...props}/>; }
