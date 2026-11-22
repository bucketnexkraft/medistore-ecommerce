import { configureStore, combineReducers, createListenerMiddleware } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import { createTransform } from "redux-persist";
import storage from "redux-persist/lib/storage";

// Reducers
import authReducer from "../slice/authSlice";
import roleRightReducer, { setRoleRight } from "../slice/roleRightSlice";
import rightReducer, { fetchRight } from "../slice/rightSlice";
import preferencesReducer from "../slice/preferencesSlice";
import partnerSliceReducer from "../slice/partnerSlice";
import customDataSliceReducer from "../slice/customDataSlice";
import userReducer from "../slice/userSlice";
import salesReducer from "../slice/saleSlice";
import companyReducer from "../slice/companySlice";

const rightPersistTransform = createTransform(
  (inboundState) => ({
    ...inboundState,
    loading: false,
    error: null,
  }),
  (outboundState) => ({
    ...outboundState,
    loading: false,
    error: null,
  }),
  { whitelist: ["right"] }
);

// Persist config
const persistConfig = {
  key: "root",
  storage,
  whitelist: ["auth", "roleright", "right"],
  transforms: [rightPersistTransform],
};

// Root reducer
const rootReducer = combineReducers({
  preferences: preferencesReducer,
  auth: authReducer,
  roleright: roleRightReducer,
  right: rightReducer,
  partners: partnerSliceReducer,
  customdata: customDataSliceReducer,
  users: userReducer,
  sales: salesReducer,
  company: companyReducer,
});

// Persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Listener middleware
const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  actionCreator: setRoleRight,
  effect: async (action, listenerApi) => {
    const accessToken = listenerApi.getState().auth.accessToken;
    if (accessToken) {
      listenerApi.dispatch(fetchRight({ accessToken, force: true }));
    }
  },
});

// Store
const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }).prepend(
      listenerMiddleware.middleware
    ),
});

// Persistor
const persistor = persistStore(store);

export { store, persistor };
