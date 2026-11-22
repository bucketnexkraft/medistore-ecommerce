import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
};

export default function CategoryStacked({ children }: Props) {
  return <>{children ?? null}</>;
}
