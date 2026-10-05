---
id: FileClass
title: File
---

### File object

||
|---|
|[<!-- INCLUDE #document.getText().Syntax -->](#gettext)<br/><!-- INCLUDE #document.getText().Summary -->|
|[<!-- INCLUDE #FileClass.setText().Syntax -->](#settext)<br/><!-- INCLUDE #FileClass.setText().Summary -->|
|[<!-- INCLUDE #FileClass.open().Syntax -->](#open)<br/><!-- INCLUDE #FileClass.open().Summary -->|

## 4D.File.new()

<details><summary>History</summary>

|Release|Changes|
|---|---|
|18 R6|Added
</details>

<!-- REF #4D.File.new().Syntax -->**4D.File.new** ( *path* : Text ) : 4D.File<!-- END REF -->

<!-- INCLUDE document.getText().Desc -->

## .setText()

<details><summary>History</summary>

|Release|Changes|
|---|---|
|19 R3|Default charset is UTF-8|
|17 R5|Added
</details>

<!--REF #FileClass.setText().Syntax -->**.setText** ( *text* : Text )<!-- END REF -->

The `.setText()` function <!-- REF #FileClass.setText().Summary -->writes *text* as the new contents of the file<!-- END REF -->. Same as [TEXT TO DOCUMENT](../commands/text-to-document).

## .open()

<details><summary>History</summary>

|Release|Changes|
|---|---|
|19 R7|Added
</details>

<!--REF #FileClass.open().Syntax -->**.open**( { *mode* : Text } ) : 4D.FileHandle<!-- END REF -->

The `.open()` function <!-- REF #FileClass.open().Summary -->creates and returns a new 4D.FileHandle object<!-- END REF -->.
