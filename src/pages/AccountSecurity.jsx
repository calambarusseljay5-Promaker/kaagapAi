import React from "react";
import { useNavigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import AccountSecurityModal from "../components/modals/AccountSecurityModal";

const AccountSecurity = () => {
  const navigate = useNavigate();

  return (
    <>
      <Dashboard />
      <AccountSecurityModal
        isOpen={true}
        onClose={() => navigate("/dashboard")}
      />
    </>
  );
};

export default AccountSecurity;
