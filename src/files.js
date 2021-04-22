import {api as backend} from './backend'

const makeFileData = (data, paramName) => {
  const formData = new FormData();
  formData.append(paramName, data)
  return formData;
}

const handleProgress = ({loaded = 0, total = 0}) => {
  const tot = (loaded / total) * 100
  return Math.round( tot || 0 )
}

 export const upload = async (data, {method = 'post', paramName = 'file',  setProgress = () => {}, url} = {} ) => {
  if(!data || !data.length) return;
  const files = Array.from(data)
  const file = files[0] // only signle upload now
  const fileData = makeFileData(file, paramName)
  const func = method == 'post' ? backend.post : backend.put
  return func(url, fileData, {
                                 onUploadProgress: (info) => setProgress(handleProgress(info)),  
                                 headers: {'Accept': 'application/json', 'Content-Type': 'multipart/form-data'}} )
  
}