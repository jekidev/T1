import { Link, useLocation } from "wouter"
import { useListScenarios, useDeleteScenario, useGetTutorialScenario, useCreateScenario, listMapTemplates } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Trash2, Plus, Play, FileText, ChevronRight, Map, ExternalLink } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createEmptyBoard, MAP_TEMPLATES } from "@/lib/game"

export default function ScenarioList() {
  const { data: scenarios, isLoading } = useListScenarios()
  const deleteScenario = useDeleteScenario()
  const createScenario = useCreateScenario()
  const { toast } = useToast()
  const [, setLocation] = useLocation()
  
  const [newScenarioOpen, setNewScenarioOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedMapTemplate, setSelectedMapTemplate] = useState(MAP_TEMPLATES[0].id)
  
  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm("Are you sure you want to delete this scenario?")) return
    
    try {
      await deleteScenario.mutateAsync({ id })
      toast({ title: "Scenario deleted" })
      window.location.reload()
    } catch (err) {
      toast({ title: "Failed to delete scenario", variant: "destructive" })
    }
  }
  
  const handleCreate = async () => {
    if (!name) return
    try {
      const board = createEmptyBoard(selectedMapTemplate)
      const res = await createScenario.mutateAsync({
        data: {
          name,
          description,
          mapTemplateId: selectedMapTemplate,
          board: board as any
        }
      })
      toast({ title: "Scenario created" })
      setNewScenarioOpen(false)
      setLocation(`/board/${res.id}`)
    } catch (err) {
      toast({ title: "Failed to create scenario", variant: "destructive" })
    }
  }
  
  const handleLoadTutorial = async () => {
    setLocation(`/board/tutorial`)
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <div className="flex justify-between items-center mb-8 border-b pb-4 border-border">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1 text-foreground">Nordlys Command</h1>
          <p className="text-muted-foreground">Tactical Command & Control Simulator</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleLoadTutorial}>
            <Play className="mr-2 h-4 w-4" />
            Load Tutorial
          </Button>
          <Dialog open={newScenarioOpen} onOpenChange={setNewScenarioOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Scenario
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Scenario</DialogTitle>
                <DialogDescription>
                  Start a new tactical planning session on a stylized map.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Scenario Name</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Operation Winter Frost" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="desc">Description (Optional)</Label>
                  <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Briefing notes..." />
                </div>
                <div className="grid gap-2">
                  <Label>Map Template</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {MAP_TEMPLATES.map(t => (
                      <div 
                        key={t.id}
                        className={`border rounded-md p-3 cursor-pointer text-sm transition-colors ${selectedMapTemplate === t.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                        onClick={() => setSelectedMapTemplate(t.id)}
                      >
                        <div className="font-medium mb-1 text-foreground">{t.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewScenarioOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!name || createScenario.isPending}>
                  {createScenario.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="text-muted-foreground animate-pulse">Loading scenarios...</div>
        </div>
      ) : scenarios?.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-xl bg-card/50">
          <Map className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2 text-foreground">No saved scenarios</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            You haven't created any planning scenarios yet. Start a new one or load the tutorial to see how it works.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => setNewScenarioOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Scenario
            </Button>
            <Button variant="secondary" onClick={handleLoadTutorial}>
              <Play className="mr-2 h-4 w-4" />
              Play Tutorial
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios?.map((scenario) => (
            <Link key={scenario.id} href={`/board/${scenario.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer flex flex-col h-full hover-elevate bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg line-clamp-1 text-card-foreground">{scenario.name}</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive -mt-2 -mr-2"
                      onClick={(e) => handleDelete(scenario.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                    {scenario.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="flex items-center text-xs text-muted-foreground mb-2">
                    <Map className="mr-2 h-3 w-3" />
                    Map: {MAP_TEMPLATES.find(t => t.id === scenario.mapTemplateId)?.name || "Unknown"}
                  </div>
                </CardContent>
                <CardFooter className="pt-0 pb-4 text-xs text-muted-foreground flex justify-between border-t border-border mt-auto px-6 py-3 bg-secondary/20">
                  <span>Updated {format(new Date(scenario.updatedAt), "MMM d, yyyy")}</span>
                  <div className="flex items-center text-primary group-hover:underline">
                    Open <ChevronRight className="ml-1 h-3 w-3" />
                  </div>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
