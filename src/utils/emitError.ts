import { AxiosError } from "axios";

const errorCodes = [401, 403, 500];

const errorMessages: Record<number, string> = {
  401: "Authentication required",
  403: "Access denied",
  500: "Server error",
};

export const emitError = (error: AxiosError): void => {
  if (
    error?.response?.status &&
    errorCodes.includes(error?.response?.status as number)
  ) {
    console.error("A network error occurs: ", error);
    const message = `${error?.response?.status}: ${
      errorMessages[error?.response?.status]
    }`;
    window.dispatchEvent(
      new CustomEvent("auth-error", {
        detail: { message },
      })
    );
  }
};
