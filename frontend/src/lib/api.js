import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

client.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

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

export const computeRoute = async (stops, meta = {}) => {
  const { data } = await client.post("/route", { stops, ...meta });
  return data;
};

export const getSettings = async () => {
  const { data } = await client.get("/settings");
  return data;
};

export const saveSettings = async (payload) => {
  const { data } = await client.put("/settings", payload);
  return data;
};

export const listDrivers = async () => {
  const { data } = await client.get("/drivers");
  return data;
};

export const createDriver = async (payload) => {
  const { data } = await client.post("/drivers", payload);
  return data;
};

export const updateDriver = async (id, payload) => {
  const { data } = await client.put(`/drivers/${id}`, payload);
  return data;
};

export const deleteDriver = async (id) => {
  const { data } = await client.delete(`/drivers/${id}`);
  return data;
};

// ---- Auth ----
export const authLogin = async (username, password) => {
  const { data } = await client.post("/auth/login", { username, password });
  return data;
};
export const authMe = async () => (await client.get("/auth/me")).data;

// ---- Users (conductores) ----
export const listUsers = async () => (await client.get("/users")).data;
export const createUser = async (p) => (await client.post("/users", p)).data;
export const updateUser = async (id, p) => (await client.put(`/users/${id}`, p)).data;
export const removeUser = async (id) => (await client.delete(`/users/${id}`)).data;

// ---- Assignments ----
export const createAssignment = async (p) => (await client.post("/assignments", p)).data;
export const myRoute = async (date) => (await client.get("/my/route", { params: date ? { date } : {} })).data;
export const myDates = async () => (await client.get("/my/dates")).data;
export const updateMyOrder = async (date, stops) => (await client.put("/my/route/order", { date, stops })).data;
export const saveStopComment = async (stopId, comment) => (await client.put("/my/route/comment", { stop_id: stopId, comment })).data;
export const mySacas = async (date) => (await client.get("/my/sacas", { params: date ? { date } : {} })).data;
export const saveMySacas = async (payload) => (await client.put("/my/sacas", payload)).data;
export const myRouteConfig = async () => (await client.get("/my/route-config")).data;
export const buildMyRoute = async () => (await client.post("/my/route/build")).data;
export const saveDriverRouteOrder = async (stops) => (await client.put("/my/driver-route/order", { date: new Date().toISOString().slice(0,10), stops })).data;
export const myCarga = async () => (await client.get("/my/carga")).data;
export const saveMyCarga = async (loadedStopIds) => (await client.put("/my/carga", { loaded_stop_ids: loadedStopIds })).data;
export const myReparto = async () => (await client.get("/my/reparto")).data;
export const saveMyReparto = async (idx, stops) => (await client.put("/my/reparto", { idx, stops })).data;

// ---- Route Configs (Configuración de rutas) ----
export const listRouteConfigs = async () => (await client.get("/route-configs")).data;
export const getRouteConfig = async (id) => (await client.get(`/route-configs/${id}`)).data;
export const createRouteConfig = async (p) => (await client.post("/route-configs", p)).data;
export const updateRouteConfig = async (id, p) => (await client.put(`/route-configs/${id}`, p)).data;
export const deleteRouteConfig = async (id) => (await client.delete(`/route-configs/${id}`)).data;
export const updateConfigStops = async (id, file) => {
  const form = new FormData();
  form.append("file", file);
  return (await client.post(`/route-configs/${id}/stops`, form, { headers: { "Content-Type": "multipart/form-data" } })).data;
};
export const saveSimulation = async (id, payload) => (await client.post(`/route-configs/${id}/simulation`, payload)).data;

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
