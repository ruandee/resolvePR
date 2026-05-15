package vulns
func searchUsers(db *sql.DB, q string) ([]User, error) {
    rows, err := db.Query("SELECT * FROM users WHERE name = '" + q + "'")
    if err != nil { return nil, err }
    defer rows.Close()
    return scanUsers(rows)
