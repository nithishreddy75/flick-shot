
import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8080/api",
  headers: {
    "Content-Type": "application/json",
  },
});

API.interceptors.request.use(
  (config) => {
    const requestUrl = config.url ?? "";

    const isAuthRequest =
      requestUrl.includes("/users/login") ||
      requestUrl.includes("/users/register") ||
      requestUrl.includes("/users/mobile-login") ||
      requestUrl.includes("/users/mobile-register");

    const token = isAuthRequest
      ? null
      : localStorage.getItem("criczone-auth-token");

    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url ?? "";

    const isAuthRequest =
      requestUrl.includes("/users/login") ||
      requestUrl.includes("/users/register") ||
      requestUrl.includes("/users/mobile-login") ||
      requestUrl.includes("/users/mobile-register");

    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem("criczone-auth-token");
      localStorage.removeItem("criczone-auth-user");
    }

    return Promise.reject(error);
  }
);

export default API;
