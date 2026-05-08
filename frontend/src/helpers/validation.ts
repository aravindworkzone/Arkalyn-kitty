export { MAX_AMOUNT as MaxAmount, handleAmountInput as validateAmount, validateGroupName as validateHeader } from "./validators";
import { validateEmail as _validateEmail } from "./validators";

export const validateEmail = (email: string): boolean =>
  _validateEmail(email).valid;
