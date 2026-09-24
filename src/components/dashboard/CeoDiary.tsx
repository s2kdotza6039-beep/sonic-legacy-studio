import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Users, CheckSquare, Plane, Bell, BookOpen, Mail, Brain } from "lucide-react";
import SydneyMemoryPanel from "./ceo/SydneyMemoryPanel";
import CeoCalendar from "./ceo/CeoCalendar";
import CeoContacts from "./ceo/CeoContacts";
import CeoTodos from "./ceo/CeoTodos";
import TouringLog from "./ceo/TouringLog";
import SubscriptionsTracker from "./ceo/SubscriptionsTracker";
import CeoOutbox from "./ceo/CeoOutbox";

const CeoDiary = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen size={18} className="text-primary" />
        <h2 className="text-xl font-display font-bold">CEO Diary</h2>
      </div>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-secondary/30">
          <TabsTrigger value="calendar" className="text-xs gap-1"><CalendarDays size={12} /> Calendar</TabsTrigger>
          <TabsTrigger value="contacts" className="text-xs gap-1"><Users size={12} /> Contacts</TabsTrigger>
          <TabsTrigger value="todos" className="text-xs gap-1"><CheckSquare size={12} /> To-Do</TabsTrigger>
          <TabsTrigger value="outbox" className="text-xs gap-1"><Mail size={12} /> Outbox</TabsTrigger>
          <TabsTrigger value="touring" className="text-xs gap-1"><Plane size={12} /> Touring</TabsTrigger>
          <TabsTrigger value="subscriptions" className="text-xs gap-1"><Bell size={12} /> Subscriptions</TabsTrigger>
          <TabsTrigger value="memory" className="text-xs gap-1"><Brain size={12} /> Sydney Memory</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar"><CeoCalendar /></TabsContent>
        <TabsContent value="contacts"><CeoContacts /></TabsContent>
        <TabsContent value="todos"><CeoTodos /></TabsContent>
        <TabsContent value="outbox"><CeoOutbox /></TabsContent>
        <TabsContent value="touring"><TouringLog /></TabsContent>
        <TabsContent value="subscriptions"><SubscriptionsTracker /></TabsContent>
        <TabsContent value="memory"><SydneyMemoryPanel /></TabsContent>
      </Tabs>
    </div>
  );
};

export default CeoDiary;
