const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const formatAsPrice = (price: number) => priceFormatter.format(price);

export const getEnvCredentials = () => ({
  loginName: import.meta.env.VITE_AUTH_LOGIN_NAME,
  password: import.meta.env.VITE_AUTH_PASSWORD,
});
