import { Inngest } from "inngest";

export const inngest = new Inngest({ 
  id: "hairaudit",
  eventKey: process.env.INNGEST_EVENT_KEY,
});