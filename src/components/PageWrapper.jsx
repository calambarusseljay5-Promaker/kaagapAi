import React from "react";
import Header from "./Header";

const PageWrapper = ({ title, description, children, actions }) => {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-transparent">
      <Header title={title} subtitle={description} actions={actions} />
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 pb-36 sm:px-6 lg:px-8 custom-scrollbar">
        <div className="gov-workspace-panel mx-auto max-w-[1600px] p-6 sm:p-8 space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PageWrapper;
