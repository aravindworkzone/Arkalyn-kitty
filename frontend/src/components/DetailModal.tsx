import { BottomSheet } from "./ui";
import type { DetailModalProps } from "../interface/modal";

export default function DetailModal({ isOpen, onClose, title, children }: DetailModalProps) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      {children}
    </BottomSheet>
  );
}
