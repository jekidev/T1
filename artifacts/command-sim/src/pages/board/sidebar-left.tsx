import { ScrollArea } from "@/components/ui/scroll-area";
import { ENTITY_TEMPLATES, CATEGORY_LABELS, Faction, EntityCategory } from "@/lib/game";
import { EntityIcon } from "./entity-renderer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export function PaletteSidebar() {
  const [search, setSearch] = useState("");

  const groups = ENTITY_TEMPLATES.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<EntityCategory, typeof ENTITY_TEMPLATES>);

  return (
    <div className="w-full h-full flex flex-col bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
      <div className="p-3 border-b border-sidebar-border bg-sidebar-primary/5">
        <h2 className="text-xs font-mono font-bold tracking-widest text-sidebar-foreground/70 uppercase mb-3">Asset Palette</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-muted-foreground" />
          <Input 
            className="pl-8 h-8 text-xs bg-sidebar-accent/50 border-sidebar-border focus-visible:ring-1" 
            placeholder="Search templates..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <Accordion type="multiple" defaultValue={["unit", "location", "surveillance"]} className="px-2">
          {(Object.entries(CATEGORY_LABELS) as [EntityCategory, string][]).map(([category, label]) => {
            const templates = groups[category]?.filter(t => t.label.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()));
            if (!templates || templates.length === 0) return null;
            
            return (
              <AccordionItem value={category} key={category} className="border-sidebar-border/50">
                <AccordionTrigger className="py-2.5 px-2 hover:bg-sidebar-accent/50 rounded-md text-xs font-semibold">
                  <div className="flex items-center">
                    {label} <span className="ml-2 text-[10px] text-muted-foreground font-normal bg-sidebar-accent/50 px-1.5 py-0.5 rounded-full">{templates.length}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3 px-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    {templates.map(t => (
                      <div
                        key={t.id}
                        className="group flex flex-col p-2 border border-sidebar-border/50 rounded-md bg-sidebar-accent/20 hover:bg-sidebar-accent hover:border-sidebar-accent-foreground/30 cursor-grab active:cursor-grabbing transition-colors"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/nordlys-template', t.id);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                      >
                        <div className="flex items-center mb-1.5">
                          <div className={`w-5 h-5 rounded-sm flex items-center justify-center mr-2 border shadow-sm ${
                            t.faction === 'police' ? 'bg-faction-police/20 border-faction-police text-blue-300' :
                            t.faction === 'criminal' ? 'bg-faction-criminal/20 border-faction-criminal text-red-300' :
                            'bg-faction-neutral/20 border-faction-neutral text-amber-300'
                          }`}>
                            <EntityIcon category={t.category} faction={t.faction} className="w-3 h-3" />
                          </div>
                          <span className="text-[10px] font-medium leading-tight line-clamp-1 flex-1" title={t.label}>{t.label}</span>
                        </div>
                        <div className="text-[9px] text-muted-foreground line-clamp-2 leading-tight">
                          {t.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>
    </div>
  );
}
