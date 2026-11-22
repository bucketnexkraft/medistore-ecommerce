import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
};

export default function FlashDealHighlight({ children }: Props) {
  return <>{children ?? null}</>;
}
