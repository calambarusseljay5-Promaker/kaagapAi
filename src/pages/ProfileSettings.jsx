import React from "react";
import { useNavigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import MyAccountModal from "../components/modals/MyAccountModal";

const ProfileSettings = () => {
  const navigate = useNavigate();

  return (
    <>
      <Dashboard />
      <MyAccountModal
        isOpen={true}
        onClose={() => navigate("/dashboard")}
      />
    </>
  );
};

export default ProfileSettings;
