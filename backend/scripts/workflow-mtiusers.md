# EmployeeWorkflow.dbo.MTIUsers Inspection

- server: 10.60.10.47
- default_database: MTIMasterEmployeeDB
- target_database: EmployeeWorkflow

## Columns
- employee_id · nvarchar · nullable=false
- employee_name · nvarchar · nullable=true
- gender · nvarchar · nullable=true
- division · nvarchar · nullable=true
- department · nvarchar · nullable=true
- section · nvarchar · nullable=true
- supervisor_id · nvarchar · nullable=true
- supervisor_name · nvarchar · nullable=true
- position_title · nvarchar · nullable=true
- grade_interval · nvarchar · nullable=true
- phone · nvarchar · nullable=true
- day_type · nvarchar · nullable=true
- description · nvarchar · nullable=true
- time_in · time · nullable=true
- time_out · time · nullable=true
- next_day · nvarchar · nullable=true
- CardNo · nvarchar · nullable=true
- AccessLevel · nvarchar · nullable=true
- Name · nvarchar · nullable=true
- FirstName · nvarchar · nullable=true
- LastName · nvarchar · nullable=true
- StaffNo · nvarchar · nullable=true

## Sample Rows (TOP 10)
- {"employee_id":"MTI210009","employee_name":"Hardi","gender":"Male","division":"Asset Management","department":"Maintenance","section":"Fabrication & Workshop","supervisor_id":"MTI230106","supervisor_name":"Muhammad Haris","position_title":"Maintenance Service Truck Operator","grade_interval":"Non Staff","phone":"082351388999","day_type":"07:00-19:00 67","description":"07:00-19:00 2 Shift Pagi Hari ke-6 dan 7","time_in":"1970-01-01T07:00:00.000Z","time_out":"1970-01-01T19:00:00.000Z","next_day":"N","CardNo":"2526806626","AccessLevel":"32","Name":"HARDI","FirstName":"","LastName":"","StaffNo":"MTI210009"}
- {"employee_id":"MTI210013","employee_name":"Muhammad Rizal","gender":"Male","division":"Operation","department":"Pyrite Plant","section":"Waste Treatment","supervisor_id":"MTI220175","supervisor_name":"Irwanto Sanjaya","position_title":"Reaction & Thickener Operator","grade_interval":"Non Staff","phone":"0852240067145","day_type":"07:00-15:00 6","description":"07:00-15:00 3 Shift Pagi Hari ke-6","time_in":"1970-01-01T07:00:00.000Z","time_out":"1970-01-01T15:00:00.000Z","next_day":"N","CardNo":"3229659746","AccessLevel":"999","Name":"MUHAMMAD RIZAL","FirstName":"","LastName":"","StaffNo":"MTI210013"}
- {"employee_id":"MTI210019","employee_name":"Hendra Wijaya","gender":"Male","division":"Operation","department":"Technical Service","section":"Laboratory","supervisor_id":"MTI230130","supervisor_name":"Indri Rosnawati Dewi","position_title":"Laboratory Sampler","grade_interval":"Non Staff","phone":"085399697499","day_type":"07:00-15:00","description":"07:00-15:00 Normal SIte","time_in":"1970-01-01T07:00:00.000Z","time_out":"1970-01-01T15:00:00.000Z","next_day":"N","CardNo":"2531495138","AccessLevel":"32","Name":"HENDRA WIJAYA","FirstName":"","LastName":"","StaffNo":"MTI210019"}
- {"employee_id":"MTI210028","employee_name":"Bahrudin","gender":"Male","division":"Asset Management","department":"Maintenance","section":"Fabrication & Workshop","supervisor_id":"MTI230106","supervisor_name":"Muhammad Haris","position_title":"Maintenance Service Truck Operator","grade_interval":"Non Staff","phone":"082193231321","day_type":"07:00-19:00 67","description":"07:00-19:00 2 Shift Pagi Hari ke-6 dan 7","time_in":"1970-01-01T07:00:00.000Z","time_out":"1970-01-01T19:00:00.000Z","next_day":"N","CardNo":"2344556055","AccessLevel":"32","Name":"BAHRUDIN","FirstName":"","LastName":"","StaffNo":"MTI210028"}
- {"employee_id":"MTI210029","employee_name":"Mursalim Malondong","gender":"Male","division":"Operation","department":"Pyrite Plant","section":"Pyrite","supervisor_id":"MTI230022","supervisor_name":"Rendra Yoga Pratama","position_title":"Pyrite Plant Master Operator","grade_interval":"Officer","phone":"081343661601","day_type":"07:00-15:00 6","description":"07:00-15:00 3 Shift Pagi Hari ke-6","time_in":"1970-01-01T07:00:00.000Z","time_out":"1970-01-01T15:00:00.000Z","next_day":"N","CardNo":"3229777378","AccessLevel":"999","Name":"MURSALIM MALONDONG","FirstName":"","LastName":"","StaffNo":"MTI210029"}
- {"employee_id":"MTI210031","employee_name":"Wawan Febriyawan","gender":"Male","division":"Support & Services","department":"Human Resources","section":"Site Service","supervisor_id":"MTI240481","supervisor_name":"Maulidha Prasetiyo","position_title":"Camp Service Assistant","grade_interval":"Non Staff","phone":"081391589819","day_type":"08:00-16:00 6","description":"08:00-16:00 3 Shift Pagi Hari ke-6","time_in":"1970-01-01T08:00:00.000Z","time_out":"1970-01-01T16:00:00.000Z","next_day":"N","CardNo":"2344581698","AccessLevel":"02","Name":"WAWAN FEBRIYAWAN","FirstName":"","LastName":"","StaffNo":"MTI210031"}
- {"employee_id":"MTI220007","employee_name":"Muhammad Iqbal Ramadhon","gender":"Male","division":"Operation","department":"Pyrite Plant","section":"Pyrite","supervisor_id":"MTI230046","supervisor_name":"Hermintoyo","position_title":"Crusher Operator","grade_interval":"Non Staff","phone":"081224972950","day_type":"07:00-15:00 6","description":"07:00-15:00 3 Shift Pagi Hari ke-6","time_in":"1970-01-01T07:00:00.000Z","time_out":"1970-01-01T15:00:00.000Z","next_day":"N","CardNo":"2349252428","AccessLevel":"999","Name":"MUHAMMAD IQBAL RAMADHON","FirstName":"","LastName":"","StaffNo":"MTI220007"}
- {"employee_id":"MTI220008","employee_name":"Muh. Asdar","gender":"Male","division":"Asset Management","department":"Maintenance","section":"Fabrication & Workshop","supervisor_id":"MTI230106","supervisor_name":"Muhammad Haris","position_title":"Maintenance Service Truck Operator","grade_interval":"Non Staff","phone":"082291747896","day_type":"07:00-19:00 67","description":"07:00-19:00 2 Shift Pagi Hari ke-6 dan 7","time_in":"1970-01-01T07:00:00.000Z","time_out":"1970-01-01T19:00:00.000Z","next_day":"N","CardNo":null,"AccessLevel":null,"Name":null,"FirstName":null,"LastName":null,"StaffNo":null}
- {"employee_id":"MTI220009","employee_name":"Ashar","gender":"Male","division":"Operation","department":"Technical Service","section":"Laboratory","supervisor_id":"MTI230130","supervisor_name":"Indri Rosnawati Dewi","position_title":"Laboratory Sampler","grade_interval":"Non Staff","phone":"085346388600","day_type":"23:00-07:00","description":"23:00-07:00 3 Shift Malam","time_in":"1970-01-01T23:00:00.000Z","time_out":"1970-01-01T07:00:00.000Z","next_day":"Y","CardNo":"2524171154","AccessLevel":"32","Name":"ASHAR","FirstName":"","LastName":"","StaffNo":"MTI220009"}
- {"employee_id":"MTI220013","employee_name":"Abdul Basir","gender":"Male","division":"Operation","department":"Pyrite Plant","section":"Pyrite","supervisor_id":"MTI230046","supervisor_name":"Hermintoyo","position_title":"Grab Crane Operator","grade_interval":"Non Staff","phone":"082225111667","day_type":"07:00-15:00 6","description":"07:00-15:00 3 Shift Pagi Hari ke-6","time_in":"1970-01-01T07:00:00.000Z","time_out":"1970-01-01T15:00:00.000Z","next_day":"N","CardNo":"2348493754","AccessLevel":"32","Name":"ABDUL BASIR","FirstName":"","LastName":"","StaffNo":"MTI220013"}
