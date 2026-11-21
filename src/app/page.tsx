import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Shield, TrendingDown, AlertTriangle, CheckCircle, Clock } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-emerald-600" />
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Buffer Guard</h1>
            <Badge variant="outline" className="border-emerald-600 text-emerald-700 font-mono">
              Janu-worry MVP
            </Badge>
          </div>
          <p className="text-slate-600 mt-1">
            Deterministic South African Retail Timing & Protected January Reserve Engine
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="success" className="px-3 py-1">
            Status: Untouchable Reserve Active
          </Badge>
        </div>
      </div>

      {/* Janu-worry Reserve Status Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-800 font-medium">Locked January Reserve</CardDescription>
            <CardTitle className="text-3xl font-black text-emerald-900">R 15,000.00</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-emerald-700">
              <CheckCircle className="h-4 w-4" />
              <span>100% Locked & Protected in Ledger</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-600 font-medium">Remaining Festive Spendable Pool</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-900">R 8,450.00</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="h-4 w-4" />
              <span>Nov & Dec Remaining Allocation</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-indigo-200 bg-indigo-50/40">
          <CardHeader className="pb-2">
            <CardDescription className="text-indigo-800 font-medium">Safe Daily Burn Rate Headroom</CardDescription>
            <CardTitle className="text-3xl font-black text-indigo-900">R 225.00 / day</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-indigo-700">
              <TrendingDown className="h-4 w-4" />
              <span>Ensures reserve remains intact on 1 January</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tracked Items & Heuristic Decision Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tracked Retail Items & Decision Engine Recommendations</CardTitle>
          <CardDescription>
            Heuristic decision models comparing candidate quotes against 5-year historical pricing & reserve headroom.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-xs font-semibold uppercase text-slate-500">
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Current Price</th>
                  <th className="py-3 px-4">Historical Baseline</th>
                  <th className="py-3 px-4">Decision Output</th>
                  <th className="py-3 px-4">AI Contextual Advisory</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                <tr className="hover:bg-slate-50">
                  <td className="py-4 px-4 font-semibold text-slate-900">LG 55" OLED C3 TV</td>
                  <td className="py-4 px-4 text-slate-600">Electronics</td>
                  <td className="py-4 px-4 font-mono font-medium text-slate-900">R 19,999.00</td>
                  <td className="py-4 px-4 font-mono text-slate-500">R 22,499.00</td>
                  <td className="py-4 px-4">
                    <Badge variant="warning">WAIT FOR NOV</Badge>
                  </td>
                  <td className="py-4 px-4 text-xs text-slate-600">
                    Historic Black Friday drops average 16.5% discount. Estimated saving: R 3,299.00.
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-4 px-4 font-semibold text-slate-900">De'Longhi Espresso Machine</td>
                  <td className="py-4 px-4 text-slate-600">Appliances</td>
                  <td className="py-4 px-4 font-mono font-medium text-slate-900">R 4,299.00</td>
                  <td className="py-4 px-4 font-mono text-slate-500">R 5,100.00</td>
                  <td className="py-4 px-4">
                    <Badge variant="success">BUY NOW</Badge>
                  </td>
                  <td className="py-4 px-4 text-xs text-slate-600">
                    Below user target price (R 4,500.00). Fits safely within November daily spend headroom.
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-4 px-4 font-semibold text-slate-900">Festive Season Catering & Braai Meat</td>
                  <td className="py-4 px-4 text-slate-600">Groceries</td>
                  <td className="py-4 px-4 font-mono font-medium text-slate-900">R 9,500.00</td>
                  <td className="py-4 px-4 font-mono text-slate-500">R 6,800.00</td>
                  <td className="py-4 px-4">
                    <Badge variant="destructive">BLOCK: RESERVE RISK</Badge>
                  </td>
                  <td className="py-4 px-4 text-xs text-red-600">
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Exceeds remaining spendable pool; touches untouchable January reserve.</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
