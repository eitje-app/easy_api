### Easy communcation between a modern front-end application & a RESTful API 

It exports a few things, the most important being 'API'.

### API:

API handles quite a bit: 
- it knows about the RESTful structure of our back-end and thus knows which endpoints map to which actions.
- it knows about our redux store and therefore is able to save the results automatically to the store
- it handles caching of the index endpoint by sending the latest updated_at value to the back-end (gets this through redux)
- it allows for easy after/before effects for all CRUD actions


Most important methods:

`index, create, update, destroy` 

Parameters:

For every method, the first parameter is 'kind', the pluralized name of the resource you're working, with, eg 'posts' or 'users'.

### Index:

Second argument is an object with possible keys:

| Key        | Explanation           | Default value  |
| ------------- |:-------------:| -----:|
| ignoreStamp     | do not send last updated stamp (disable caching) |  |
| inverted    | Flip directions: get all records updated BEFORE stamp      |    |
| localKind | The local redux 'kind', useful if you want to save it differently in your local store than it's called in your back-end     |    |
| refresh | Ignore caching & reset redux store    |    |
| params | extra params to be sent with the request   | {}    |



## Create/Update:

Create/update share the exact same parameters. The first argument is kind, the second 'params' (the data you wanna send) which is automatically converted to Rails' strong parameter style, as: `{record_name: data}` and the third is an object again with all other options:


| Key        | Explanation           | Default value  |
| ------------- |:-------------:| -----:|
| local    |  If local is false, it will only save it in the back-end but not in the local redux store    | true   |
| localKind | The local redux 'kind', useful if you want to save it differently in your local store than it's called in your back-end     |    |
| extraParams | extra params which will be inserted at the top level  | {}    |


## Destroy:

Destroy takes an id as a second argument, and accepts an object with as only key extraParams to be included at the top-level of your data.



Examples:

`const users = API.index("users") ## will get only new users`
`const users = API.index("users", {refresh: true}) ## will reset the redux store and fetch all fresh records from back-end`



`const newUser = API.create("users", {name: 'Amazing guy', fat: false})`

`const updatedUser = API.update("users", {id: 4, name: 'Fatty guy', fat: true}) ## you have to insert the ID when updating`


`API.destroy("users", 1) # destroy always goes by id`



