import { useEffect } from "react";
import { getEnvCredentials } from "~/utils/utils";

export const useAuthInit = () => {
  useEffect(() => {
    const { loginName, password } = getEnvCredentials();

    if (loginName && password) {
      const token = btoa(`${loginName}=${password}`);
      localStorage.setItem("authorization_token", token);
    } else {
      console.warn(
        "Auth credentials are not provided in environment variables"
      );
    }
  }, []);
};
