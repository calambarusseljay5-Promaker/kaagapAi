import { supabase } from "../lib/supabaseClient.js";
import { getRealDocumentTemplateKey, DOCUMENT_TYPE_REQUIREMENTS } from "../utils/realDocumentTemplates.js";

/**
 * Controlled Function Calling declarations for KaagapAI
 */
export const KAAGAPAI_FUNCTION_DECLARATIONS = [
  {
    name: "get_my_profile",
    description: "Get the profile information of the currently logged-in resident (name, purok, verification status, contact).",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "get_my_requests",
    description: "Retrieve all document requests submitted by the logged-in resident with live system statuses (Pending, Processing, Ready for Pickup, Released).",
    parameters: {
      type: "OBJECT",
      properties: {
        document_type: {
          type: "STRING",
          description: "Optional: Filter by specific document type (e.g. Barangay Clearance, Certificate of Residency)",
        },
      },
    },
  },
  {
    name: "get_request_status",
    description: "Check the exact live status of a resident's requested document.",
    parameters: {
      type: "OBJECT",
      properties: {
        document_type: {
          type: "STRING",
          description: "The name of the document to check status for (e.g., Barangay Clearance, Indigency, Residency)",
        },
      },
      required: ["document_type"],
    },
  },
  {
    name: "get_document_fee",
    description: "Retrieve the current official fee for a document directly from the live database templates.",
    parameters: {
      type: "OBJECT",
      properties: {
        document_type: {
          type: "STRING",
          description: "The name or alias of the document (e.g., Barangay Clearance, Residency, Indigency, Business Permit)",
        },
      },
      required: ["document_type"],
    },
  },
  {
    name: "get_document_requirements",
    description: "Retrieve the official approved requirements for a document directly from the live database templates.",
    parameters: {
      type: "OBJECT",
      properties: {
        document_type: {
          type: "STRING",
          description: "The name of the document (e.g., Barangay Clearance, 4Ps, Solo Parent, Indigency)",
        },
      },
      required: ["document_type"],
    },
  },
  {
    name: "check_duplicate_request",
    description: "Check if the resident already has a pending or processing request for the specified document to prevent duplicate submissions.",
    parameters: {
      type: "OBJECT",
      properties: {
        document_type: {
          type: "STRING",
          description: "The document name to check for existing pending requests",
        },
      },
      required: ["document_type"],
    },
  },
];

/**
 * Executes a controlled tool call against live Supabase data
 */
export async function executeAiFunction(functionName, args = {}, context = {}) {
  const resident = context.resident || null;
  const residentId = resident?.id || resident?.resident_id || null;

  switch (functionName) {
    case "get_my_profile": {
      if (!resident) {
        return { success: false, message: "No resident currently logged in." };
      }
      return {
        success: true,
        full_name: resident.full_name || "Resident",
        purok: resident.purok || "Not specified",
        email: resident.email || "Not specified",
        contact_number: resident.contact_number || "Not specified",
        status: resident.status || "Active",
      };
    }

    case "get_my_requests": {
      if (!residentId) {
        return { success: false, requests: context.requests || [] };
      }
      try {
        let query = supabase
          .from("document_requests")
          .select("id, document_type, status, purpose, created_at, tracking_number")
          .eq("resident_id", residentId)
          .order("created_at", { ascending: false });

        if (args.document_type) {
          query = query.ilike("document_type", `%${args.document_type}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return { success: true, requests: data || [] };
      } catch (err) {
        return { success: false, requests: context.requests || [], error: err.message };
      }
    }

    case "get_request_status": {
      const docType = args.document_type || "";
      const currentRequests = context.requests || [];
      const match = currentRequests.find((r) =>
        (r.document_type || "").toLowerCase().includes(docType.toLowerCase())
      );

      if (match) {
        const rawStatus = match.status || "Pending";
        const displayStatus = String(rawStatus).toLowerCase() === "completed" ? "Ready for Pick-up" : rawStatus;
        return {
          success: true,
          document_type: match.document_type,
          status: displayStatus,
          requested_date: match.created_at,
          tracking_number: match.tracking_number || null,
        };
      }

      if (residentId) {
        try {
          const { data } = await supabase
            .from("document_requests")
            .select("document_type, status, created_at, tracking_number")
            .eq("resident_id", residentId)
            .ilike("document_type", `%${docType}%`)
            .order("created_at", { ascending: false })
            .limit(1);

          if (data && data[0]) {
            const rawStatus = data[0].status || "Pending";
            const displayStatus = String(rawStatus).toLowerCase() === "completed" ? "Ready for Pick-up" : rawStatus;
            return {
              success: true,
              document_type: data[0].document_type,
              status: displayStatus,
              requested_date: data[0].created_at,
              tracking_number: data[0].tracking_number || null,
            };
          }
        } catch {
          // continue
        }
      }

      return {
        success: false,
        message: `No active request found for ${docType}.`,
      };
    }

    case "get_document_fee": {
      const docType = (args.document_type || "").toLowerCase();
      const templates = context.documentTemplates || [];
      const matched = templates.find((t) =>
        (t.template_name || t.document_type || "").toLowerCase().includes(docType)
      );

      if (matched?.fee) {
        const raw = String(matched.fee).trim();
        const feeFormatted = /free|libre/i.test(raw)
          ? "Free of Charge"
          : /^\d+$/.test(raw)
          ? `₱${raw}.00 cash per request`
          : raw;
        return {
          success: true,
          document_type: matched.template_name || matched.document_type,
          fee: feeFormatted,
        };
      }

      try {
        const { data } = await supabase
          .from("document_templates")
          .select("template_name, fee")
          .ilike("template_name", `%${docType}%`)
          .limit(1);

        if (data && data[0]?.fee) {
          return {
            success: true,
            document_type: data[0].template_name,
            fee: data[0].fee,
          };
        }
      } catch {
        // continue
      }

      return {
        success: true,
        document_type: args.document_type,
        fee: /indigency|4ps/i.test(docType) ? "Free of Charge" : "₱50.00 cash per request",
      };
    }

    case "get_document_requirements": {
      const docType = (args.document_type || "").toLowerCase();
      const docKey = getRealDocumentTemplateKey(docType);
      const customReqs = DOCUMENT_TYPE_REQUIREMENTS[docKey] || DOCUMENT_TYPE_REQUIREMENTS.general;

      const templates = context.documentTemplates || [];
      const matched = templates.find((t) =>
        (t.template_name || t.document_type || "").toLowerCase().includes(docType)
      );

      let formattedRequirements = "";
      if (customReqs?.items?.length) {
        formattedRequirements = customReqs.items.map((it, i) => `${i + 1}. ${it}`).join("\n");
      } else if (matched?.requirements) {
        formattedRequirements = matched.requirements;
      } else {
        formattedRequirements = "1. Cedula (Community Tax Certificate) — Required\n2. Valid Government ID / Resident Identification\n3. Proof of Purpose or Supporting Document";
      }

      return {
        success: true,
        document_type: matched?.template_name || matched?.document_type || customReqs?.title || args.document_type,
        requirements: formattedRequirements,
        note: customReqs?.reminder || "Dalhin ang inyong Cedula at Valid ID sa Barangay Hall kapag kukunin na ang orihinal na dokumento.",
      };
    }

    case "check_duplicate_request": {
      const docType = (args.document_type || "").toLowerCase();
      const targetKey = getRealDocumentTemplateKey(docType);
      const activeStatuses = ["pending", "processing", "approved", "ready", "ready for pick-up", "ready for pickup", "ready to pick up"];

      // First check in-memory context requests
      let existing = (context.requests || []).find((r) => {
        const rStatus = String(r.status || "").trim().toLowerCase();
        if (!activeStatuses.includes(rStatus)) return false;
        const rKey = getRealDocumentTemplateKey(r.document_type);
        const rName = String(r.document_type || "").toLowerCase();
        return (targetKey && rKey && targetKey === rKey) || rName.includes(docType) || docType.includes(rName);
      });

      // If not found in context, query Supabase directly if residentId exists
      if (!existing && residentId) {
        try {
          const { data } = await supabase
            .from("document_requests")
            .select("id, document_type, status, created_at, tracking_number")
            .eq("resident_id", residentId)
            .order("created_at", { ascending: false });

          if (data && data.length > 0) {
            existing = data.find((r) => {
              const rStatus = String(r.status || "").trim().toLowerCase();
              if (!activeStatuses.includes(rStatus)) return false;
              const rKey = getRealDocumentTemplateKey(r.document_type);
              const rName = String(r.document_type || "").toLowerCase();
              return (targetKey && rKey && targetKey === rKey) || rName.includes(docType) || docType.includes(rName);
            });
          }
        } catch (e) {
          console.warn("Error checking duplicate request from Supabase:", e);
        }
      }

      if (existing) {
        const rawStatus = existing.status || "Pending";
        const displayStatus = String(rawStatus).toLowerCase() === "completed" ? "Ready for Pick-up" : rawStatus;
        return {
          has_pending: true,
          document_type: existing.document_type,
          status: displayStatus,
          tracking_number: existing.tracking_number || `REQ-${String(existing.id).slice(0, 8)}`,
          message: `You currently have an active/pending request for ${existing.document_type} (${displayStatus}). You cannot submit a duplicate request while the current one is not yet released or completed.`,
        };
      }

      return {
        has_pending: false,
        message: "No pending duplicate request found. You may proceed with a new request for this document.",
      };
    }

    default:
      return { error: `Function ${functionName} not recognized.` };
  }
}
