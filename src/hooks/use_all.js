import { useSelector } from "react-redux";
import { all } from "../all_selector";

export const useAll = (kind, opts) => {
  const items = useSelector((state) => all(state, kind, opts));
  return items;
};

export default useAll;
