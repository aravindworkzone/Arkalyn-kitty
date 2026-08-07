import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Button from "./Button";

interface Props {
  isLoading: boolean;
  submitLabel: string;
  loadingLabel?: string;
  disabled?: boolean;
  onCancel?: () => void;
}

/** Cancel + submit pair closing a form. Built on the design-system Button. */
export default function FormActions({
  isLoading,
  submitLabel,
  loadingLabel,
  disabled,
  onCancel,
}: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="flex gap-3 pt-1">
      <Button
        type="button"
        variant="secondary"
        fullWidth
        className="flex-1 py-3"
        onClick={onCancel ?? (() => navigate(-1))}
      >
        {t("deleteModal.cancel")}
      </Button>
      <Button
        type="submit"
        fullWidth
        className="flex-1 py-3"
        loading={isLoading}
        loadingLabel={loadingLabel ?? `${submitLabel}…`}
        disabled={disabled}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
