import React from "react";
import Header from "./Header";

const PageWrapper = ({ title, description, children, actions }) => {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-transparent">
      <Header title={title} subtitle={description} actions={actions} />
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pl-2 pr-3 py-2 sm:pl-3 sm:pr-4 sm:py-3 pb-20 custom-scrollbar">
        <div className="gov-workspace-panel w-full p-3 sm:p-4 space-y-4 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PageWrapper;
