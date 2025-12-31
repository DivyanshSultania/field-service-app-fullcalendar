On creation of task create task_team_members and attach it with task for further edits.
Staff
    1. On click of view option, open a new tab which will list down all the tasks related to current staff based on the date range which by default range should be 1 week by sepcifying the start and end date in query parameter. For this you will have to add a new endpoint in backend.
    2. In edit option, make password field as optional.
Team
    1. [DONE] Role of the Team members should render on edit or create of team.
    2. [DONE] Description is not getting saved in DB.
    3. [DONE] Team status is not retained in DB.
    4. Supervisor info should be reflected as soon as the team is created or updated.
Client
    1. [DONE] ABN and ACN needs to be retained in DB
    2. [DONE] Business details should be client information.
Schedule
    Search list view which is to list down all the tasks based on the filters selected. 
    Available filters are from date, to date, supervisor, client, and view type. In view type options are Individual, Group by staff and group by client.
    If user selects Individual then it will list down all the tasks.
    If Group By Staff then group tasks based on staff.
    If group by Client then group tasks based on client.
    The table should have columns "Shift Staff", "Scheduled date time", "Log date time", "Log Length"

Calendar
    1. [DONE] Filter option in the side bar should show staff, client and team based on selected button.
    2. [DONE] Selected filter should filter down tasks on calendar.
    3. [DONE] Add a create task button beside calendar navigation.
    4. Details should be reflected while curson is hovering around the scheduled task. The details should include Supervisor ending with bracket(s), cleaners, client name, shift instruction, start time and end time.

Tasks
    1. At top it should have tabs Shift Details, Repeat and Roster.
    2. Shift details tab, Task modal should have left panel having Shift, Client, Instruction and Report.
    3. Shift section will have ability to see and edit supervisor, cleaner or team.
    4. Shift section shall provide ability to edit schedule settings i.e. Dat, time and Duration.
    5. Shift section shall provide ability to edit client location details.
    6. Add a checkbox for Publish option in shift section to update the database.
    
        Client 
        Note : Any modification in client details should be reflected only in task data.
        1. Client tab should have a client assignment dropdown option. The dropdown option should contain the list of all client stored in database.
        2. After selecting the client details, the client tab shall have the ability to edit Client Name, Phone Number, Email Address, Company Name, ABN, ACN, Clint Instructions, Client information and Property information. 
        3. The changes made in the above should only be reflected for the particular task and should not be modified in the main client info.
        4. If any modification is done, then a Save option should be activated. Upon selecting the Save option the details must be saved.

        Instruction :
        1. At top it should have Instruction Management as the header
        2. The tab should show all the existing instructions of the client.
        3. The tab should have edit option of the existing operation.
        4. The tab should have ability to add new instructions. Along with the new instruction it should also ask for response type. The response type shall have three options - Checkbox option for OK Confirmation, Checkbox option for Yes/No option and Checkbox option for Text Response.

        Report :



