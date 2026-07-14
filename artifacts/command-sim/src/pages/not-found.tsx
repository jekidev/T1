import { useLocation } from "wouter"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  const [, setLocation] = useLocation()
  
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background gap-4">
      <h1 className="text-4xl font-bold font-mono tracking-widest text-primary">404</h1>
      <p className="text-muted-foreground text-sm uppercase tracking-widest">Sector Not Found</p>
      <Button variant="outline" className="mt-4" onClick={() => setLocation("/")}>
        Return to Command Center
      </Button>
    </div>
  )
}
