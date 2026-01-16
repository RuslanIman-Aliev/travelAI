import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { loginWithGoogle, logout } from "@/lib/actions/auth.actions";
import { SidebarLogo } from "@/components/sidebar-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenuMain } from "@/components/sidebar-menu-main"; 

const AppSidebar = async () => {
  const session = await auth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarLogo />
      </SidebarHeader>

      <SidebarContent>
        {/* Главное меню: Dashboard, New Trip, Live Guide + Theme Toggle */}
        <SidebarGroup>
          <SidebarGroupContent>
             <SidebarMenuMain />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {!session?.user ? (
              <form action={loginWithGoogle} className="w-full">
                <Button type="submit" variant="outline" className="w-full justify-start gap-2">
                   <span>Sign in</span>
                </Button>
              </form>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={session.user.image || ""} />
                      <AvatarFallback className="rounded-lg">U</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{session.user.name}</span>
                      <span className="truncate text-xs">{session.user.email}</span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-56 rounded-lg" side="bottom" align="end" sideOffset={4}>
                  <form action={logout}>
                    <DropdownMenuItem asChild>
                      <button className="w-full flex items-center cursor-pointer text-red-600 hover:text-red-600 focus:text-red-600">
                        Log out
                      </button>
                    </DropdownMenuItem>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;