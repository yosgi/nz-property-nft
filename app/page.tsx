import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowRight, Home, Map, CheckCircle, BarChart3, FileText } from "lucide-react"

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="py-12 md:py-16">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Property NFT Platform</h1>
            <p className="max-w-[700px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
              Tokenize, verify, and valuate real estate properties on the blockchain
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild>
                <Link href="/submit">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <Home className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Submit Property</CardTitle>
            <CardDescription>Register your property details</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Submit your property information to create a digital representation on the blockchain.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/submit">Submit Property</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <FileText className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>NFT Representation</CardTitle>
            <CardDescription>View your property as an NFT</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              See how your property is represented as a non-fungible token with all relevant metadata.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/nft">View NFT</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <Map className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>3D Property Map</CardTitle>
            <CardDescription>Visualize properties in 3D</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Explore properties in an interactive 3D map powered by CesiumJS.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/map">Explore Map</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CheckCircle className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Community Verification</CardTitle>
            <CardDescription>Verify property authenticity</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Participate in community verification of property details using blockchain voting.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/verify">Verify Properties</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <BarChart3 className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Property Valuation</CardTitle>
            <CardDescription>Get estimated property value</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              View the estimated value of properties based on market data and comparables.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/valuation">View Valuation</Link>
            </Button>
          </CardFooter>
        </Card>
      </section>
    </div>
  )
}
