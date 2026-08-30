import React from "react";
import { useNavigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import SystemSettingsModal from "../components/modals/SystemSettingsModal";

const Settings = () => {
  const navigate = useNavigate();

  return (
    <>
      <Dashboard />
      <SystemSettingsModal
        isOpen={true}
        onClose={() => navigate("/dashboard")}
      />
    </>
  );
};

export default Settings;
