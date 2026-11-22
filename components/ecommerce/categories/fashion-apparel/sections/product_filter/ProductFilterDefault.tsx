import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
};

export default function ProductFilterDefault({ children }: Props) {
  return <>{children ?? null}</>;
}

