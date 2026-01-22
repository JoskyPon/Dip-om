USE InsuranceCompany
GO

-- 1. Passport (паспортные данные)
CREATE TABLE Passport (
    SeriesAndNumberOfPassport INT PRIMARY KEY,
    DateOfIssue DATE NOT NULL,
    IssuedBy NVARCHAR(100) NOT NULL,
    -- Проверка даты выдачи (не будущее)
    CONSTRAINT CHK_Passport_Date CHECK (DateOfIssue <= GETDATE())
);

-- 2. Categories (категории прав)
CREATE TABLE Categories (
    CategoriesId INT PRIMARY KEY IDENTITY(1, 1),
    KategoryA BIT NOT NULL DEFAULT 0,
    KategoryB BIT NOT NULL DEFAULT 0,
    KategoryC BIT NOT NULL DEFAULT 0,
    KategoryD BIT NOT NULL DEFAULT 0,
    KategoryM BIT NOT NULL DEFAULT 0,
    -- Проверка, что хотя бы одна категория выбрана
    CONSTRAINT CHK_Categories_NotEmpty CHECK (
        KategoryA = 1 OR 
        KategoryB = 1 OR 
        KategoryC = 1 OR 
        KategoryD = 1 OR 
        KategoryM = 1
    )
);

-- 3. DriverLicense (водительские удостоверения)
CREATE TABLE DriverLicense (
    DriverLicenseNumber INT PRIMARY KEY,
    DateOfIssue DATE NOT NULL,
    AvailableCategories INT NOT NULL,
    FOREIGN KEY (AvailableCategories) REFERENCES Categories(CategoriesId),
    -- Проверка даты выдачи (не будущее)
    CONSTRAINT CHK_License_Date CHECK (DateOfIssue <= GETDATE()),
);

-- 4. Vehicle (транспортные средства)
CREATE TABLE Vehicle (
    RegistrationNumber VARCHAR(9) PRIMARY KEY,
    VINNumber VARCHAR(17) UNIQUE NOT NULL,
    VehicleBrand NVARCHAR(50) NOT NULL,
    VehicleModel NVARCHAR(100) NOT NULL,
    YearOfRelease INT NOT NULL,
    EnginePower INT NOT NULL,
    VehicleRegistrationCertificateNumber NVARCHAR(10) UNIQUE NOT NULL,
    -- Проверка года выпуска
    CONSTRAINT CHK_Vehicle_Year CHECK (
        YearOfRelease BETWEEN 1900 AND YEAR(GETDATE()) + 1
    ));

-- 5. Post (должности сотрудников)
CREATE TABLE Post (
    PostId INT PRIMARY KEY IDENTITY(1, 1),
    PostName NVARCHAR(100) UNIQUE NOT NULL,
    Salary NUMERIC(9, 4),
    -- Зарплата не может быть отрицательной
    CONSTRAINT CHK_Salary CHECK (Salary >= 0)
);

-- 6. Client (клиенты)
CREATE TABLE Client (
    ClientId INT PRIMARY KEY IDENTITY(1, 1),
    ClientSurname NVARCHAR(100) NOT NULL,
    ClientName NVARCHAR(100) NOT NULL,
    ClientPatronymic NVARCHAR(100) NOT NULL,
    ClientPhoneNumber DECIMAL(11,0) UNIQUE NOT NULL,
    ClientEmail VARCHAR(100) UNIQUE,
    ClientPassword NVARCHAR(255) NOT NULL, -- Для хэша
    ClientPasswordSalt NVARCHAR(128) NOT NULL, -- Для хэширования
    SeriesAndNumberOfPassport INT,
    DriverLicenseNumber INT,
    RegistrationNumber VARCHAR(9),
    FOREIGN KEY (SeriesAndNumberOfPassport) REFERENCES Passport(SeriesAndNumberOfPassport),
    FOREIGN KEY (DriverLicenseNumber) REFERENCES DriverLicense(DriverLicenseNumber),
    FOREIGN KEY (RegistrationNumber) REFERENCES Vehicle(RegistrationNumber),
    -- Проверка формата email
    CONSTRAINT CHK_Client_Email CHECK (
        ClientEmail IS NULL OR 
        ClientEmail LIKE '%_@__%.__%'
    ),
    -- Проверка телефона (российский формат: 7XXXXXXXXXX)
    CONSTRAINT CHK_Client_Phone_Format CHECK (
        ClientPhoneNumber BETWEEN 89000000000 AND 89999999999
    ),
);

-- 7. Employee (сотрудники)
CREATE TABLE Employee (
    EmployeeId INT PRIMARY KEY IDENTITY(1, 1),
    EmployeeSurname NVARCHAR(100) NOT NULL,
    EmployeeName NVARCHAR(100) NOT NULL,
    EmployeePatronymic NVARCHAR(100) NOT NULL,
    EmployeePhoneNumber DECIMAL(11,0) UNIQUE,
    EmployeeEmail VARCHAR(100) UNIQUE,
    HireDate DATE,
    Post INT,
    FOREIGN KEY (Post) REFERENCES Post(PostId),
    -- Проверка формата email
    CONSTRAINT CHK_Employee_Email CHECK (
        EmployeeEmail IS NULL OR 
        EmployeeEmail LIKE '%_@__%.__%'
    ),
    -- Проверка телефона
    CONSTRAINT CHK_Employee_Phone CHECK (
        EmployeePhoneNumber IS NULL OR
        EmployeePhoneNumber BETWEEN 89000000000 AND 89999999999
    ),
    -- Проверка даты найма
    CONSTRAINT CHK_HireDate CHECK (
        HireDate IS NULL OR 
        HireDate <= GETDATE()
    ),
    -- Проверка ФИО
    CONSTRAINT CHK_Employee_Name CHECK (
        LEN(TRIM(EmployeeSurname)) > 0 AND
        LEN(TRIM(EmployeeName)) > 0
    )
);

-- 8. InsuranceProduct (страховые продукты)
CREATE TABLE InsuranceProduct (
    ProductId INT PRIMARY KEY IDENTITY(1, 1),
    ProductName NVARCHAR(100) UNIQUE NOT NULL,
    ProductType NVARCHAR(100) NOT NULL,
    ProductDescription NVARCHAR(150),
    BasicCost NUMERIC(9, 4) NOT NULL,
    Active BIT NOT NULL DEFAULT 1,
    -- Проверка стоимости
    CONSTRAINT CHK_BasicCost CHECK (BasicCost > 0),
    -- Проверка типа продукта (допустимые значения)
    CONSTRAINT CHK_Product_Type CHECK (
        ProductType IN ('ОСАГО', 'КАСКО')
    )
);

-- 9. Payment (платежи)
CREATE TABLE Payment (
    PaymentId INT PRIMARY KEY IDENTITY(1, 1),
    PaymentAmount NUMERIC(9, 4),
    PaymentDate DATE DEFAULT GETDATE(),
    PaymentMethod NVARCHAR(100),
    PaymentStatus BIT NOT NULL DEFAULT 0,
    CheckNumber INT UNIQUE NOT NULL,
    -- Проверка суммы платежа
    CONSTRAINT CHK_PaymentAmount CHECK (PaymentAmount > 0),
    -- Проверка даты платежа
    CONSTRAINT CHK_PaymentDate CHECK (PaymentDate <= GETDATE()),
    -- Проверка метода оплаты
    CONSTRAINT CHK_PaymentMethod CHECK (
        PaymentMethod IN ('Банковская карта', 'Наличные', 'Банковский перевод')
    ),
);

-- 10. ApplicationForRegistration (заявки на регистрацию)
CREATE TABLE ApplicationForRegistration (
    ApplicationId INT PRIMARY KEY IDENTITY(1, 1),
    ClientId INT NOT NULL,
    EmployeeId INT NOT NULL,
    RegistrationNumber VARCHAR(9) NOT NULL,
    ProductId INT NOT NULL,
    ApplicationDate DATETIME DEFAULT GETDATE(),
    Status NVARCHAR(50) DEFAULT 'Ожидание',
    FOREIGN KEY (ClientId) REFERENCES Client(ClientId),
    FOREIGN KEY (EmployeeId) REFERENCES Employee(EmployeeId),
    FOREIGN KEY (RegistrationNumber) REFERENCES Vehicle(RegistrationNumber),
    FOREIGN KEY (ProductId) REFERENCES InsuranceProduct(ProductId),
    -- Проверка даты заявки
    CONSTRAINT CHK_ApplicationDate CHECK (ApplicationDate <= GETDATE()),
    -- Проверка статуса заявки
    CONSTRAINT CHK_Application_Status CHECK (
        Status IN ('Ожидание', 'Завершено', 'Отменено')
    ),
);

-- 11. InsurancePolicy (страховые полисы)
CREATE TABLE InsurancePolicy (
    PolicyNumber INT PRIMARY KEY IDENTITY(100000, 1),
    StartDate DATE NOT NULL,
    EndDate DATE NOT NULL,
    PolicyStatus BIT NOT NULL DEFAULT 1,
    PolicyCost NUMERIC(9, 4) NOT NULL,
    DateOfRegistration DATE DEFAULT GETDATE(),
    PaymentId INT,
    ApplicationId INT NOT NULL,
    FOREIGN KEY (PaymentId) REFERENCES Payment(PaymentId),
    FOREIGN KEY (ApplicationId) REFERENCES ApplicationForRegistration(ApplicationId),
    -- Проверка дат полиса
    CONSTRAINT CHK_Policy_Dates CHECK (EndDate > StartDate),
    -- Проверка, что дата начала не в прошлом (для новых полисов)
    CONSTRAINT CHK_StartDate CHECK (StartDate >= GETDATE()),
    -- Проверка стоимости
    CONSTRAINT CHK_PolicyCost CHECK (PolicyCost > 0),
    -- Проверка даты регистрации
    CONSTRAINT CHK_RegistrationDate CHECK (DateOfRegistration <= GETDATE()),
    -- Проверка, что для активного полиса есть платеж
    CONSTRAINT CHK_Policy_Payment CHECK (
        (PolicyStatus = 0) OR -- если полис неактивен, платеж может быть NULL
        (PolicyStatus = 1 AND PaymentId IS NOT NULL) -- если активен, платеж обязателен
    )
);