import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmployeeTable } from "@/components/employees/EmployeeTable";
import { Button } from "@/components/ui/button";
import { mockEmployees, getEmployeeStats } from "@/data/mockEmployees";
import { Users, UserCheck, UserX, Globe, MapPin, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  const stats = getEmployeeStats();
  const recentEmployees = mockEmployees.slice(0, 5);

  return (
    <MainLayout title="Dashboard" subtitle="Employee Master Data Overview">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 animate-fade-in">
        <StatCard
          title="Total Employees"
          value={stats.total}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Active"
          value={stats.active}
          icon={UserCheck}
          variant="success"
        />
        <StatCard
          title="Inactive"
          value={stats.inactive}
          icon={UserX}
        />
        <StatCard
          title="Indonesia"
          value={stats.indonesia}
          icon={MapPin}
        />
        <StatCard
          title="Expatriate"
          value={stats.expat}
          icon={Globe}
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Recent Employees</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/employees">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <EmployeeTable employees={recentEmployees} />
        </div>

        <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h2 className="font-display text-lg font-semibold">Quick Actions</h2>
          
          <div className="space-y-3">
            <Link 
              to="/employees/new"
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-elevated hover:border-primary/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
                <Users className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-medium">Add New Employee</p>
                <p className="text-sm text-muted-foreground">Register a new employee</p>
              </div>
            </Link>

            <Link 
              to="/employees?type=indonesia"
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-elevated hover:border-primary/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <MapPin className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-medium">Indonesia Employees</p>
                <p className="text-sm text-muted-foreground">{stats.indonesia} employees</p>
              </div>
            </Link>

            <Link 
              to="/employees?type=expat"
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-elevated hover:border-primary/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <Globe className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="font-medium">Expatriate Employees</p>
                <p className="text-sm text-muted-foreground">{stats.expat} employees</p>
              </div>
            </Link>
          </div>

          {/* Department Distribution */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <h3 className="font-medium mb-3">Department Distribution</h3>
            <div className="space-y-2">
              {['ICT', 'Engineering', 'Finance', 'Operation'].map((dept) => {
                const count = mockEmployees.filter(e => e.employment.division === dept).length;
                const percentage = (count / stats.total) * 100;
                return (
                  <div key={dept}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{dept}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full rounded-full gradient-primary transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
