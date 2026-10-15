import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ChainProvider } from "./lib/ChainContext";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Token from "./pages/Token";
import Block from "./pages/Block";
import Tx from "./pages/Tx";
import Address from "./pages/Address";
import NotFound from "./pages/NotFound";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ChainProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="token" element={<Token />} />
            <Route path="block/:id" element={<Block />} />
            <Route path="tx/:hash" element={<Tx />} />
            <Route path="address/:address" element={<Address />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ChainProvider>
  </StrictMode>
);
