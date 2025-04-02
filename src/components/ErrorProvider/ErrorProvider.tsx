import { Alert, Snackbar } from "@mui/material";
import { useState, createContext, ReactNode, useCallback } from "react";

export type ErrorContextType = {
  showError: (message: string) => void;
};

export const ErrorContext = createContext<ErrorContextType>({
  showError: (() => {
    throw new Error("ErrorContext not initialized");
  }) as (message: string) => void,
});

export const ErrorProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const showError = useCallback((message: string) => {
    setMessage(message);
    setOpen(true);
  }, []);

  return (
    <ErrorContext.Provider value={{ showError }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={5000}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        onClose={() => setOpen(false)}
      >
        <Alert onClose={() => setOpen(false)} severity="error">
          {message}
        </Alert>
      </Snackbar>
    </ErrorContext.Provider>
  );
};
