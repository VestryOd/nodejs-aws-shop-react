import { useContext, useEffect } from "react";
import { ErrorContext } from "~/components/ErrorProvider/ErrorProvider";

export const useGlobalErrors = () => {
  const { showError } = useContext(ErrorContext);

  useEffect(() => {
    const handleAuthError = (event: CustomEvent) => {
      showError(event.detail.message);
    };

    window.addEventListener("auth-error", handleAuthError as EventListener);

    return () => {
      window.removeEventListener(
        "auth-error",
        handleAuthError as EventListener
      );
    };
  }, [showError]);
};
