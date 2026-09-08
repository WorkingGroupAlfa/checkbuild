export type EnquiryPayload = {
  building: string;
  level: string;
  suite?: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
};

export async function submitEnquiry(_payload: EnquiryPayload) {
  // Integration point: replace with a project-approved CRM or server endpoint.
  // The default application deliberately sends no personal data off-device.
  await new Promise((resolve) => window.setTimeout(resolve, 350));
  return { submitted: false, localOnly: true } as const;
}
