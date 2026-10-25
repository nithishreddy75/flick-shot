
import axios from "axios";

const API = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV
      ? "http://localhost:8080/api"
      : "https://flick-shot-backend.onrender.com/api"),
  timeout: 15000,
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
