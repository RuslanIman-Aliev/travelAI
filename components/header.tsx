import { MonitorCogIcon, Moon, Sun } from "lucide-react";
import { ModeToggle } from "./utils/mode-toggle";

const Header = ({ name }: { name: string }) => {
  return <>
  <div className="flex justify-between w-full " >
   <div>{name}</div>
   <div className="flex space-x-5">
     <ModeToggle/>
    </div>
    </div>
  </>;
}
 
export default Header;