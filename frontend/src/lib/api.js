import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

export const importExcel = async (file) => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post("/import-excel", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const geocode = async (q) => {
  const { data } = await client.get("/geocode", { params: { q } });
  return data;
};

export const optimizeRoute = async (payload) => {
  const { data } = await client.post("/optimize", payload);
  return data;
};

export const computeRoute = async (stops) => {
  const { data } = await client.post("/route", { stops });
  return data;
};

export const saveRoute = async (payload) => {
  const { data } = await client.post("/routes", payload);
  return data;
};

export const updateRoute = async (id, payload) => {
  const { data } = await client.put(`/routes/${id}`, payload);
  return data;
};

export const listRoutes = async () => {
  const { data } = await client.get("/routes");
  return data;
};

export const deleteRoute = async (id) => {
  const { data } = await client.delete(`/routes/${id}`);
  return data;
};

export const exportRoute = async (stops) => {
  const res = await client.post("/export", { stops }, { responseType: "blob" });
  return res.data;
};
