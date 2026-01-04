import { MonitorCogIcon, Moon, Sun } from "lucide-react";

const Header = ({ name }: { name: string }) => {
  return <>
  <div className="flex justify-between w-full " >
   <div>{name}</div>
   <div className="flex space-x-5">
    <span>Theme  </span>
   
    <Sun/>
    <Moon/>
    <MonitorCogIcon/>
    </div>
    </div>
  </>;
}
 
export default Header;